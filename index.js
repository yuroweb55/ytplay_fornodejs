const express = require('express');
const ytdl =  require('@distube/ytdl-core');
const compression = require('compression');
const cors = require('cors');
const https = require('https');

const app = express();

app.use(cors());
app.use(compression());



app.get('/', async (req, res) => {
    try {
        const { id,quality='360p' } = req.query;
        if (id && id !== "") {
            const info = await ytdl.getInfo(id);
            const data = info.formats
                .filter(format => format.qualityLabel === quality && format.hasVideo && !format.hasAudio)
                .reduce((prev, current) => (prev.contentLength < current.contentLength) ? prev : current, {});

            if (data.url) {
                if (req.aborted) { return; }
                res.redirect(`/play_video?url=${encodeURIComponent(data.url)}&idvideo=${id}`);
            } else {
                return res.status(404).json({ error: 'ไม่พบวิดีโอ '+quality+' ที่พร้อมใช้งาน' });
            }
        } else {
            res.status(400).json({ error: 'กรุณาใส่ ID ของวิดีโอ' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

app.get('/play_video', (req, res) => {
    let videoUrl = req.query.url;
    try {
        if (!videoUrl) {
            return res.status(400).send('Video URL is required');
        }
        videoUrl = decodeURIComponent(videoUrl);

        const range = req.headers.range || 'bytes=0-';

        // ตั้งค่า Header
        const headers = {
            "accept": "*/*",
            "accept-language": "th",
            "range": range,
            "sec-ch-ua": "\"Chromium\";v=\"130\", \"Google Chrome\";v=\"130\", \"Not?A_Brand\";v=\"99\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "video",
            "sec-fetch-mode": "no-cors",
            "sec-fetch-site": "cross-site",
            "Referer": "https://www.youtube.com/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        };

        // ดึงข้อมูลจาก URL ด้วย HTTPS
        https.get(videoUrl, { headers }, (videoRes) => {
            const statusCode = videoRes.statusCode;
            const contentRange = videoRes.headers['content-range'];
            const contentType = videoRes.headers['content-type'];

            // ตรวจสอบสถานะการตอบกลับ
            if (statusCode === 200 || statusCode === 206) {
                res.status(statusCode).set({
                    'Content-Range': contentRange || '',
                    'Accept-Ranges': 'bytes',
                    'Content-Type': contentType,
                    'Connection': 'keep-alive',  // ใช้ Keep-Alive สำหรับการเชื่อมต่อที่ยาวขึ้น
                });

                // ส่งข้อมูลวิดีโอไปยัง Client แบบ Stream
                videoRes.pipe(res);
            } else {
                if(req.query.idvideo){
                    res.redirect('/?id='+req.query.idvideo);
                }else{
                    res.status(statusCode).send('Failed to fetch video');
                }
            }
        }).on('error', (err) => {
            console.error('Error fetching video:', err.message);
            res.status(500).send('Error fetching video');
        });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดที่ไม่คาดคิด:', error);
        res.status(500).send('Unexpected error');
    }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
