const { Router } = require("express")

// const contentController = require("../controllers/contentController")
const contentRouter = Router()
const multer = require('multer')
const upload = multer({ dest: 'public/uploads' })

contentRouter.post("/upload-file", upload.single("newFile"), function (req, res, next) {
    const fileInfo = req.file
    console.log(fileInfo)
    res.redirect("/")
    // req.file info
    /* 
    fieldname: 'newFile',
    originalname: 'upload-me.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    destination: 'public/uploads',
    filename: 'b0a45b7591d386cdc3691ef6c442798e',
    path: 'public/uploads/b0a45b7591d386cdc3691ef6c442798e',
    size: 12
    */
})

// contentRouter.post("/add-folder", middleware here)

module.exports = contentRouter