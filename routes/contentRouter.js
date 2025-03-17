const { Router } = require("express")

// const contentController = require("../controllers/contentController")
const contentRouter = Router()
const multer = require('multer')
const upload = multer({ dest: 'public/uploads' })
const { PrismaClient } = require("@prisma/client")
const { name } = require("ejs")
const prisma = new PrismaClient()

contentRouter.post("/folder/:folderId/upload-file", upload.single("newFile"), async function (req, res, next) {
    const fileInfo = req.file
    const folderId = req.params.folderId

    console.log(folderId)
    const addFiletoFolder = await prisma.folder.update({
        where: {
            id: folderId
        },
        data: {
            files: {
                create: {
                    name: fileInfo.fieldname,
                    updloadedAt: new Date(),
                    size: Number(fileInfo.size)
                }
            }
        }
    })

    // if (addFiletoFolder.files)
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

// contentRouter.get("/folder/:folderId", middleware here)
// contentRouter.get("/folder/:folderId/file/:fileId/details", middleware here)

module.exports = contentRouter