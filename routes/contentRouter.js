const { Router } = require("express")

// const contentController = require("../controllers/contentController")
const contentRouter = Router()
const multer = require('multer')
const upload = multer({ dest: 'public/uploads' })
const { PrismaClient } = require("@prisma/client")
const { name } = require("ejs")
const prisma = new PrismaClient()

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

contentRouter.post("/add-folder", async function (req, res, next) {
    const { newFolder } = req.body
    const { id } = req.user
    const addFolder = await prisma.user.update({
        where: {
            id: id
        },
        data: {
            folders: {
                create: {
                    name: newFolder,
                }
            }
        }
    })
    res.redirect("/")
})

module.exports = contentRouter