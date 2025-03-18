const { Router } = require("express")
const path = require("path")
const fs = require("node:fs")
// const contentController = require("../controllers/contentController")
const contentRouter = Router()
const multer = require('multer')
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads')
    },
    filename: function (req, file, cb) {
        // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.originalname)
    }
})
const upload = multer({ storage: storage })
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

    console.log(fileInfo)

    // if (addFiletoFolder.files)

    // console.log(path.join(__dirname, 'public/uploads', 'index.html'))
    res.redirect("/")
    return
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
    console.log(req.file)

    res.render("file-details", {
        file: file,
        date: JSON.stringify(file.updloadedAt)
    })
})

// contentRouter.get("/files/:fileId/edit-file", async (req, res) => {
//     const fileId = req.params.fileId

//     // console.log(folderId)

//     const file = await prisma.file.findFirst({
//         where: {
//             id: fileId
//         }
//     })

//     res.render("edit-file", {
//         file: file
//     })
// })

// contentRouter.post("/files/:fileId/edit-file", async (req, res) => {
//     const fileId = req.params.fileId
//     const newName = req.body.editFile

//     // console.log(newName)

//     const updateName = await prisma.file.update({
//         where: {
//             id: fileId
//         },
//         data: {
//             name: newName
//         }
//     })

//     res.redirect("/")
// })

contentRouter.post("/files/:fileId/delete-file", async (req, res) => {
    const fileId = req.params.fileId

    const deleteFile = await prisma.file.delete({
        where: {
            id: fileId
        }
    })
    res.redirect("/")
})

module.exports = contentRouter