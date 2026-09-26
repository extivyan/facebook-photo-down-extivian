const express = require('express');
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/api/extract-fv', async (req, res) => {
    try {
        const targetUrl = req.body.url;
        if (!targetUrl) {
            return res.status(400).json({ success: false, message: 'الرجاء إرسال الرابط (url)' });
        }

        // إنشاء CookieJar جديد لكل طلب لضمان عدم تداخل الجلسات في بيئة السيرفرليس
        const cookieJar = new tough.CookieJar();
        const client = wrapper(axios.create({ jar: cookieJar, timeout: 15000 }));

        // 1. زيارة الصفحة لجلب الكوكيز المطلوبة أولاً
        try {
            await client.get('https://fvdownloader.net/facebook-profile-picture-viewer', {
                headers: { 
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9,ar;q=0.8'
                }
            });
        } catch (e) {
            console.error('Cookie Fetch Error:', e.message);
        }

        // 2. إرسال طلب الـ POST
        const formData = new URLSearchParams();
        formData.append('query', targetUrl);
        formData.append('downloader', 'profile');

        const response = await client.post('https://fvdownloader.net/req', formData, {
            headers: {
                'accept': 'application/json, text/javascript, */ *; q=0.01',
                'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                'origin': 'https://fvdownloader.net',
                'referer': 'https://fvdownloader.net/facebook-profile-picture-viewer',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const htmlContent = response.data?.html;
        if (!htmlContent) {
            return res.status(200).json({ 
                success: false, 
                message: 'فشل في استخراج المحتوى من الموقع الخارجي، قد يكون الرابط غير صحيح أو الحساب خاص.' 
            });
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
            return res.status(200).json({ 
                success: false, 
                message: 'لم يتم العثور على رابط تحميل الصورة في الرد.' 
            });
        }

        // إرجاع الرابط المباشر بنجاح
        return res.json({
            success: true,
            message: 'تم استخراج رابط الصورة بنجاح!',
            downloadUrl: downloadLink
        });

    } catch (error) {
        console.error('API Catch Error:', error.message);
        return res.status(200).json({ 
            success: false, 
            message: 'حدث خطأ تقني أثناء معالجة الطلب من السيرفر.',
            details: error.message 
        });
    }
});

module.exports = app;
