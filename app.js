require("dotenv").config()
const express = require("express")
const session = require("express-session")
const { PrismaSessionStore } = require("@quixo3/prisma-session-store")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const passport = require("passport")
const localStrategy = require("passport-local").Strategy
const bcrypt = require("bcryptjs")
const path = require("node:path")
const fs = require("node:fs")

const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const app = express()

// routers here
const userRouter = require("./routes/userRouter")
const contentRouter = require("./routes/contentRouter")

app.set("view engine", "ejs")
app.use(express.static("public"))

app.use(
    session({
        cookie: {
            maxAge: 730 * 24 * 60 * 60 * 1000 // ms
        },
        secret: "lorem ipsum",
        resave: true,
        saveUninitialized: false,
        store: new PrismaSessionStore(
            prisma,
            {
                checkPeriod: 2 * 60 * 1000, // ms
                dbRecordIdIsSessionId: true,
                dbRecordIdFunction: undefined,
            }
        )
    })
)
app.use(passport.session())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

passport.use(
    new localStrategy(async (username, password, done) => {
        try {
            const user = await prisma.user.findUnique({
                where: {
                    name: username
                }
            })

            if (!user) return done(null, false, { message: "Incorrect username..." })

            const match = await bcrypt.compare(password, user.password)
            if (!match) return done(null, false, { message: "Incorrect password..." })

            return done(null, user)
        } catch (err) {
            return done(err)
        }
    })
)

passport.serializeUser((user, done) => {
    done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: id
            }
        })
        done(null, user)
    } catch (err) {
        done(err)
    }
})


app.use((req, res, next) => {
    res.locals.currentUser = req.user
    next()
})

app.get("/", async (req, res) => {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }

    const folders = await prisma.user.findUnique({
        where: {
            id: res.locals.currentUser.id
        },
        include: {
            folders: true,
        }
    });

    res.render("index", {
        user: res.locals.currentUser,
        folders: folders.folders
    });
});

app.get("/sign-up", (req, res) => {
    res.render("sign-up", {
        user: res.locals.currentUser,
    })
})

app.get("/login", (req, res) => {
    res.render("login", {
        user: res.locals.currentUser,
    })
})

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
}))

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err)
        res.redirect("/")
    })
})

app.get("/add-folder", (req, res) => {
    res.render("add-folder")
})

app.get("/content/folder/:folderId/upload-file", async (req, res) => {
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

app.get("/download/:fileId", async (req, res) => {
    const fileId = req.params.fileId

    const file = await prisma.file.findFirst({
        where: {
            id: fileId
        }
    })

    const filePath = path.resolve(__dirname, 'public/uploads', file.name)
    res.download(filePath)
    return
})

app.use("/user", userRouter)
app.use("/content", contentRouter)

const PORT = 3000
app.listen(PORT, "0.0.0.0", () => {
    console.log(`listening on http://localhost:${PORT}`)
})