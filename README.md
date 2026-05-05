# Hunarmand Punjab Complaint Portal - Backend

The robust and secure backend API for the Hunarmand Punjab Complaint Portal, built with Node.js, Express, and MongoDB.

## 🛠️ Features
- **Secure Authentication**: JWT-based auth with role-based access control (Student, Staff, Admin, Manager).
- **Real-time Engine**: Socket.io integration for instant notifications and live chat.
- **File Management**: Cloudinary integration for secure and scalable attachment storage.
- **Security Suite**: Implemented Helmet, Rate Limiting, Mongo Sanitize, HPP, and XSS-Clean.
- **Advanced Analytics**: Aggregated statistics for dashboards and reports.
- **Email/SMS Ready**: Architecture ready for notification integrations.

## 🚀 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Storage**: Cloudinary
- **Logging**: Morgan

## 📦 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the `Complaint-Portal-Backend` directory:
   ```env
   PORT=3200
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_name
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   ```

3. **Run the Server**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

---

## 👨‍💻 Developer Credits
**Developed by:** Dev Asad  
**Email:** [devasad0278@gmail.com](mailto:devasad0278@gmail.com)  
**Portfolio:** [devasad.stackfellows.com](https://devasad.stackfellows.com)  

**Company:** Hunarmand Punjab  
© 2026 Hunarmand Punjab Complaint Portal. All rights reserved.
