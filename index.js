const express = require('express');
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

app.post('/api/extract-fv', async (req, res) => {
    try {
        const targetUrl = req.body.url;
        if (!targetUrl) {
            return res.status(400).json({ error: 'الرجاء إرسال الرابط (url)' });
        }

        // 1. زيارة الصفحة لجلب الكوكيز المطلوبة أولاً
        await client.get('https://fvdownloader.net/facebook-profile-picture-viewer', {
            headers: { 
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9,ar;q=0.8'
            }
        });

        // 2. إرسال طلب الـ POST مع مطابقة الـ Headers تماماً للطلب الحقيقي
        const formData = new URLSearchParams();
        formData.append('query', targetUrl);
        formData.append('downloader', 'profile');

        const response = await client.post('https://fvdownloader.net/req', formData, {
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                'origin': 'https://fvdownloader.net',
                'referer': 'https://fvdownloader.net/facebook-profile-picture-viewer',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const htmlContent = response.data?.html;
        if (!htmlContent) {
            return res.status(500).json({ error: 'فشل في استخراج المحتوى من الموقع', raw: response.data });
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

        // إرجاع الرابط المباشر
        res.json({
            success: true,
            message: 'تم استخراج رابط الصورة بنجاح!',
            downloadUrl: downloadLink
        });

    } xcatch (error) {
        // ... (سيتم التقاط الخطأ وإرجاعه)
    }
});
