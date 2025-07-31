const { Router } = require("express")
const passport = require('passport')
const prisma = require('../prisma/prisma')
const { createClient } = require('@supabase/supabase-js')

const indexRouter = Router()

const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

indexRouter.get("/", async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/login")
    }

    const folders = await prisma.user.findUnique({
        where: {
            id: res.locals.currentUser.id
        },
        include: {
            folders: true,
        }
    })

    res.render("index", {
        user: res.locals.currentUser,
        folders: folders.folders
    })
})

indexRouter.get("/sign-up", (req, res) => {
    res.render("sign-up", {
        user: res.locals.currentUser,
    })
})

indexRouter.get("/login", (req, res) => {
    res.render("login", {
        user: res.locals.currentUser,
    })
})

indexRouter.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
}))

indexRouter.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err)
        res.redirect("/")
    })
})

indexRouter.get("/add-folder", (req, res) => {
    res.render("add-folder")
})

indexRouter.get("/content/folder/:folderId/upload-file", async (req, res) => {
    const folderId = req.params.folderId

    const folder = await prisma.folder.findFirst({
        where: {
            id: folderId
        }
    })

    res.render("file-upload", {
        folder: folder
    })
})

indexRouter.get("/download/:fileId", async (req, res) => {
    const fileId = req.params.fileId

    try {
        const file = await prisma.file.findUnique({
            where: {
                id: fileId
            },
            select: {
                name: true,
                folderId: true
            }
        })

        if (!file) {
            console.log(`File with ID ${fileId} not found in database.`)
            return res.status(404).send("File not found in our records.")
        }

        const bucketName = 'files'

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(file.name, 3600)

        if (signedUrlError) {
            console.error('Error generating signed URL:', signedUrlError)
            return res.status(500).send("Failed to generate download link.")
        }

        if (!signedUrlData || !signedUrlData.signedUrl) {
            console.error('Signed URL data or signedUrl property is missing.')
            return res.status(500).send("Failed to retrieve signed download link.")
        }

        res.redirect(signedUrlData.signedUrl)

    } catch (error) {
        console.error("Error in download route:", error)
        res.status(500).send("An internal error occurred during file download.")
    }
})

module.exports = indexRouter