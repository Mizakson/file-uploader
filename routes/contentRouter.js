const { Router } = require("express")
const contentRouter = Router()

// Import the new controller
const contentController = require('../controllers/contentController')

// Assign controller functions to each route
contentRouter.post("/folder/:folderId/upload-file", contentController.uploadMiddleware, contentController.uploadFile)
contentRouter.post("/add-folder", contentController.addFolder)
contentRouter.get("/:folderId/edit-folder", contentController.getEditFolder)
contentRouter.post("/:folderId/edit-folder", contentController.postEditFolder)
contentRouter.post("/:folderId/delete-folder", contentController.deleteFolder)
contentRouter.get("/folder/:folderId/files", contentController.getFiles)
contentRouter.get("/files/:fileId", contentController.getFileDetails)
contentRouter.post("/files/:fileId/delete-file", contentController.deleteFile)

module.exports = contentRouter