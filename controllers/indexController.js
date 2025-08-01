const path = require("path")
const fs = require("node:fs")
const { Readable } = require('stream')

const passport = require('passport')
const prisma = require('../prisma/prisma')
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)


exports.getIndex = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/login")
    }

    try {
        const folders = await prisma.user.findUnique({
            where: {
                id: res.locals.currentUser.id
            },
            include: {
                folders: true,
            }
        })

        if (!folders) {
            return res.status(404).render('error-page', { message: "User not found." });
        }

        res.render("index", {
            user: res.locals.currentUser,
            folders: folders.folders
        })
    } catch (error) {
        console.error("Error in getIndex:", error);
        next(error);
    }
}

exports.getSignUp = (req, res) => {
    res.render("sign-up", {
        user: res.locals.currentUser,
    })
}

exports.getLogin = (req, res) => {
    res.render("login", {
        user: res.locals.currentUser,
    })
}

exports.postLogin = passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
})

exports.getLogout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err)
        res.redirect("/")
    })
}


exports.getAddFolder = (req, res) => {
    res.render("add-folder")
}

exports.getUploadFile = async (req, res, next) => {
    const folderId = req.params.folderId

    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: folderId
            }
        })

        if (!folder) {
            return res.status(404).render('error-page', { message: "Folder not found." });
        }

        res.render("file-upload", {
            folder: folder
        })
    } catch (error) {
        console.error("Error in getUploadFile:", error);
        next(error);
    }
}

exports.getDownloadFile = async (req, res, next) => {
    const fileId = req.params.fileId
    const bucketName = 'files'

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
            return res.status(404).render('error-page', { message: "File not found in our records." })
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(file.name, 3600) // 3600 sec = 1 hr

        if (signedUrlError) {
            console.error('Error generating signed URL:', signedUrlError)
            return res.status(500).render('error-page', { message: "Failed to generate download link." })
        }

        if (!signedUrlData || !signedUrlData.signedUrl) {
            console.error('Signed URL data or signedUrl property is missing.')
            return res.status(500).render('error-page', { message: "Failed to retrieve signed download link." })
        }

        const response = await fetch(signedUrlData.signedUrl)

        if (!response.ok) {
            console.error('Error fetching file from Supabase:', response.statusText)
            return res.status(500).render('error-page', { message: "Failed to fetch file for download." })
        }

        // Content-Disposition header forces the download in the browser.
        res.setHeader('Content-Disposition', `attachment filename="${file.name}"`)

        // convert Web ReadableStream to a Node.js Readable stream.
        const nodeStream = Readable.fromWeb(response.body)

        // pipe the Node.js stream to the response.
        nodeStream.pipe(res)

    } catch (error) {
        console.error("Error in download route:", error)
        next(error)
    }
}