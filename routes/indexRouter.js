const { Router } = require("express")
const router = Router()

// Import the new controller
const indexController = require("../controllers/indexController")

// Assign controller functions to each route
router.get("/", indexController.getIndex)
router.get("/sign-up", indexController.getSignUp)
router.get("/login", indexController.getLogin)
router.post("/login", indexController.postLogin)
router.get("/logout", indexController.getLogout)
router.get("/add-folder", indexController.getAddFolder)
router.get("/content/folder/:folderId/upload-file", indexController.getUploadFile)
router.get("/download/:fileId", indexController.getDownloadFile)

module.exports = router