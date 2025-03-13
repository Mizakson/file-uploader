const { validationResult, body } = require("express-validator")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const bcrypt = require("bcryptjs")

exports.createNewUser = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: "Validation failed",
            errors: errors.array()
        })
    }

    try {
        const { username, password } = req.body
        const hashedPw = await bcrypt.hash(password, 10)
        const newUser = await prisma.user.create({
            data: {
                name: username,
                password: hashedPw
            }
        })
        console.log("USER ADDED...", newUser)
        res.redirect("/")

    } catch (error) {
        console.error("User creation error", error)
        res.status(500).json({
            message: "An error occured while creating the user",
            error: error.message,
        })
    }
}

exports.validateUser = [
    body("username").isAlpha().notEmpty().withMessage("Please enter a username"),
    body("password").isLength({ min: 6 }).withMessage("Password must be a minimum of 6 characters"),
    body("confirmPassword").custom((value, { req }) => value === req.body.password).withMessage("Passwords must match")
]