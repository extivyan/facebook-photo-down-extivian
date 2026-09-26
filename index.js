const express = require('express');
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// استخدام ذاكرة مؤقتة للكوكيز
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

app.post('/api/extract-fv', async (req, res) => {
    try {
        const targetUrl = req.body.url;
        if (!targetUrl) {
            return res.status(400).json({ error: 'الرجاء إرسال الرابط (url)' });
        }

        // 1. زيارة الصفحة لجلب الكوكيز
        await client.get('https://fvdownloader.net/facebook-profile-picture-viewer', {
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        // 2. إرسال طلب استخراج البيانات
        const formData = new URLSearchParams();
        formData.append('query', targetUrl);
        formData.append('downloader', 'profile');

        const response = await client.post('https://fvdownloader.net/req', formData, {
            headers: {
                'accept': 'application/json, text/javascript, */ *; q=0.01',
                'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                'referer': 'https://fvdownloader.net/facebook-profile-picture-viewer',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const htmlContent = response.data.html;
        if (!htmlContent) {
            return res.status(500).json({ error: 'فشل في استخراج المحتوى من الموقع' });
        }

        // 3. قراءة الـ HTML واستخراج رابط الـ HD
        const $ = cheerio.load(htmlContent);
        let downloadLink = null;
        
        $('a.btn.btn-blue').each((i, el) => {
            const text = $(el).text();
            const href = $(el).attr('href');
            if (text.includes('HD Quality') && href) {
                downloadLink = href;
            }
        });

        if (!downloadLink) {
            downloadLink = $('a.btn.btn-blue').first().attr('href');
        }

        if (!downloadLink) {
            return res.status(500).json({ error: 'لم يتم العثور على رابط تحميل الصورة في الرد' });
        }

        // 4. إرجاع رابط التحميل المباشر للعميل (مناسب لـ Vercel)
        res.json({
            success: true,
            message: 'تم استخراج رابط الصورة بنجاح!',
            downloadUrl: downloadLink
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            error: 'حدث خطأ أثناء معالجة الطلب', 
            details: error.response?.data || error.message 
        });
    }
});

// تصدير التطبيق ليعمل مع Vercel Serverless
module.exports = app;