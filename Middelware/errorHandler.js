export const errorHandler = (err, req, res, next) => {
    console.error(`❌ [Server Error]: ${err.message}`);
    
    // If the error status is 200 (which is default), force it to 500 (Internal Server Error)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    
    res.json({
        success: false,
        message: err.message,
        // In production, hide the stack trace to prevent security leaks
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};
