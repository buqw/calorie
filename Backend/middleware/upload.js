const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req,file,cb) => {
        if(file.mimetype.startsWith('image/')){
            cb(null,true);
        }
        else{
            cb(new Error('Only image files are allowed.'))
        }
    }
})

module.exports = upload