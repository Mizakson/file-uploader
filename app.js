require("dotenv").config()
const express = require("express")
const session = require("express-session")
const { PrismaSessionStore } = require("@quixo3/prisma-session-store")
const { PrismaClient } = require("@prisma/client")
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

// require("./config/passport")(passport)

app.use((req, res, next) => {
    res.locals.currentUser = req.user
    next()
})