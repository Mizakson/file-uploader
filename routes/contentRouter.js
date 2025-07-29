const { Router } = require("express")
const path = require("path")
const fs = require("node:fs")
const multer = require('multer')

const contentRouter = Router()

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const upload = multer({ storage: multer.memoryStorage() })

contentRouter.post("/folder/:folderId/upload-file", upload.single("newFile"), async function (req, res, next) {
    const fileInfo = req.file
    const folderId = req.params.folderId

    if (!fileInfo) {
        console.error('No file received from Multer.')
        return res.status(400).send("No file data received.")
    }

    let fileBuffer
    if (fileInfo.buffer) {
        fileBuffer = fileInfo.buffer
    } else if (fileInfo.path) {
        try {
            fileBuffer = fs.readFileSync(fileInfo.path)
        } catch (readError) {
            console.error('Error reading file from temporary path (disk storage):', readError)
            return res.status(500).send("Failed to read the uploaded file from disk.")
        }
    } else {
        console.error('Multer did not provide a file buffer or path.')
        return res.status(500).send("Internal server error: File data not accessible.")
    }

    let supabaseUploadError = null
    let supabaseData = null
    let filePublicUrl = null

    try {
        const { data, error } = await supabase.storage
            .from('files')
            .upload(fileInfo.originalname, fileBuffer, {
                contentType: fileInfo.mimetype,
                upsert: false,
                duplex: 'half'
            })

        if (error) {
            supabaseUploadError = error
        } else {
            supabaseData = data
            console.log('Supabase upload successful:', supabaseData)


            if (supabaseData && supabaseData.path) {
                const { data: publicUrlData } = supabase.storage.from('files').getPublicUrl(supabaseData.path)
                if (publicUrlData && publicUrlData.publicUrl) {
                    filePublicUrl = publicUrlData.publicUrl
                    console.log('Supabase public URL:', filePublicUrl)
                } else {
                    console.warn('Could not retrieve public URL data from Supabase.')
                }
            } else {
                console.warn('Supabase data or path not available after upload.')
            }
        }
    } catch (uploadError) {
        supabaseUploadError = uploadError
    } finally {
        if (fileInfo.path) {
            fs.unlink(fileInfo.path, (err) => {
                if (err) console.error('Error deleting temporary file:', err)
                else console.log('Temporary file deleted:', fileInfo.path)
            });
        }
    }

    if (supabaseUploadError) {
        console.error('Supabase upload error details:', supabaseUploadError)
        return res.status(500).send("File upload to Supabase failed.")
    }

    try {
        await prisma.folder.update({
            where: {
                id: folderId
            },
            data: {
                files: {
                    create: {
                        name: fileInfo.originalname,
                        updloadedAt: new Date(),
                        size: Number(fileInfo.size),
                        publicUrl: filePublicUrl
                    }
                }
            }
        });
        console.log('File info and public URL added to database for folder:', folderId)
    } catch (prismaError) {
        console.error('Prisma error adding file to folder:', prismaError)
        return res.status(500).send("Failed to update folder in database.")
    }

    res.redirect("/");
    return;
});

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