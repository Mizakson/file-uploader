const { Router } = require("express")

// const contentController = require("../controllers/contentController")
const contentRouter = Router()
const multer = require('multer')
const upload = multer({ dest: 'public/uploads' })
const { PrismaClient } = require("@prisma/client")
const { name } = require("ejs")
const { json } = require("stream/consumers")
const prisma = new PrismaClient()

contentRouter.post("/folder/:folderId/upload-file", upload.single("newFile"), async function (req, res, next) {
    const fileInfo = req.file
    const folderId = req.params.folderId

    // console.log(folderId)
    const addFiletoFolder = await prisma.folder.update({
        where: {
            id: folderId
        },
        data: {
            files: {
                create: {
                    name: fileInfo.originalname,
                    updloadedAt: new Date(),
                    size: Number(fileInfo.size),
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

contentRouter.get("/:folderId/edit-folder", async (req, res) => {
    const folderId = req.params.folderId

    // console.log(folderId)

    const folder = await prisma.folder.findFirst({
        where: {
            id: folderId
        }
    })

    // console.log(folder)

    res.render("edit-folder", {
        folder: folder
    })
})

contentRouter.post("/:folderId/edit-folder", async (req, res) => {
    const folderId = req.params.folderId
    const newName = req.body.editFolder

    // console.log(newName)

    const updateName = await prisma.folder.update({
        where: {
            id: folderId
        },
        data: {
            name: newName
        }
    })

    // const folder = await prisma.folder.findFirst({
    //     where: {
    //         id: folderId
    //     }
    // })
    // console.log(folder)

    res.redirect("/")
})

contentRouter.post("/:folderId/delete-folder", async (req, res) => {
    const folderId = req.params.folderId

    const deleteFolder = await prisma.folder.delete({
        where: {
            id: folderId
        }
    })

    res.redirect("/")
})

contentRouter.get("/folder/:folderId/files", async (req, res) => {
    const folderId = req.params.folderId

    const folder = await prisma.folder.findFirst({
        where: {
            id: folderId
        },
        include: {
            files: true
        }
    })

    // console.log(folder)

    res.render("view-files", {
        folder: folder,
        files: folder.files
    })
})

contentRouter.get("/files/:fileId", async (req, res) => {
    const fileId = req.params.fileId

    const file = await prisma.file.findFirst({
        where: {
            id: fileId
        }
    })

    res.render("file-details", {
        file: file,
        date: JSON.stringify(file.updloadedAt)
    })
})

module.exports = contentRouter