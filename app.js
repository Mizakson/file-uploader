require("dotenv").config()
const express = require("express")
const session = require("express-session")
const { PrismaSessionStore } = require("@quixo3/prisma-session-store")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const passport = require("passport")
const localStrategy = require("passport-local").Strategy

const app = express()

// routers here

app.set("view engine", "ejs")
app.use(express.static("public"))

app.use(
    session({
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000 // ms
        },
        secret: "lorem ipsum",
        resave: true,
        saveUninitialized: false,
        store: new PrismaSessionStore(
            new PrismaClient(),
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

        console.log(user)
        done(null, user)
    } catch (err) {
        done(err)
    }
})


app.use((req, res, next) => {
    res.locals.currentUser = req.user
    next()
})