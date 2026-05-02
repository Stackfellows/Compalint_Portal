import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// 1. Configure Cloudinary v2
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Use Memory Storage for Multer (Better for Serverless/Render)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 3. Modern Cloudinary Upload Helper (Stream-based)
const uploadToCloudinary = (fileBuffer, folder = 'complaint_portal', originalName = '') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                folder: folder, 
                resource_type: 'auto',
                flags: 'attachment', // Suggests browser to download/open correctly
                public_id: `${Date.now()}-${originalName.split('.')[0]}`.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        uploadStream.end(fileBuffer);
    });
};

export { cloudinary, upload, uploadToCloudinary };
