const path = require("path")
const fs = require("node:fs")
const multer = require('multer')
const prisma = require("../prisma/prisma")
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const upload = multer({ storage: multer.memoryStorage() })

exports.uploadMiddleware = upload.single("newFile")

exports.uploadFile = async function (req, res, next) {
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
}

exports.addFolder = async function (req, res, next) {
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
}

exports.getEditFolder = async (req, res) => {
    const folderId = req.params.folderId

    const folder = await prisma.folder.findFirst({
        where: {
            id: folderId
        }
    })

    res.render("edit-folder", {
        folder: folder
    })
}

exports.postEditFolder = async (req, res) => {
    const folderId = req.params.folderId
    const newName = req.body.editFolder

    const updateName = await prisma.folder.update({
        where: {
            id: folderId
        },
        data: {
            name: newName
        }
    })

    res.redirect("/")
}

exports.deleteFolder = async (req, res) => {
    const folderId = req.params.folderId

    const deleteFolder = await prisma.folder.delete({
        where: {
            id: folderId
        }
    })
    res.redirect("/")
}

exports.getFiles = async (req, res) => {
    const folderId = req.params.folderId

    const folder = await prisma.folder.findFirst({
        where: {
            id: folderId
        },
        include: {
            files: true
        }
    })

    res.render("view-files", {
        folder: folder,
        files: folder.files
    })
}

exports.getFileDetails = async (req, res) => {
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
}

exports.deleteFile = async (req, res) => {
    const fileId = req.params.fileId

    const deleteFile = await prisma.file.delete({
        where: {
            id: fileId
        }
    })
    res.redirect("/")
}