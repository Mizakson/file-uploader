// create mocks first, then import controller
const mockSupabaseUpload = jest.fn()
const mockSupabaseGetPublicUrl = jest.fn()
const mockPrismaUserUpdate = jest.fn()
const mockPrismaFolderUpdate = jest.fn()
const mockPrismaFolderFindFirst = jest.fn()
const mockPrismaFolderDelete = jest.fn()
const mockPrismaFileFindFirst = jest.fn()
const mockPrismaFileDelete = jest.fn()
const mockFsUnlink = jest.fn((path, cb) => cb(null))
const mockFsReadFileSync = jest.fn()

jest.mock('../prisma/prisma', () => ({
    user: {
        update: mockPrismaUserUpdate,
    },
    folder: {
        update: mockPrismaFolderUpdate,
        findFirst: mockPrismaFolderFindFirst,
        delete: mockPrismaFolderDelete,
    },
    file: {
        findFirst: mockPrismaFileFindFirst,
        delete: mockPrismaFileDelete,
    },
}))

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        storage: {
            from: jest.fn(() => ({
                upload: mockSupabaseUpload,
                getPublicUrl: mockSupabaseGetPublicUrl,
            })),
        },
    })),
}))

jest.mock('multer', () => {
    const multer = () => ({
        single: () => (req, res, next) => {
            req.file = {
                fieldname: 'newFile',
                originalname: 'test.txt',
                encoding: '7bit',
                mimetype: 'text/plain',
                buffer: Buffer.from('test content'),
                size: 12
            }
            next()
        }
    })
    multer.memoryStorage = () => ({})
    return multer
})

jest.mock('node:fs', () => ({
    ...jest.requireActual('node:fs'),
    readFileSync: mockFsReadFileSync,
    unlink: mockFsUnlink,
}))


const contentController = require('../controllers/contentController')

describe('contentController', () => {
    let mockRequest
    let mockResponse
    const mockNext = jest.fn()

    beforeEach(() => {
        mockRequest = {
            params: {},
            body: {},
            user: { id: 'test-user-id' },
            file: {
                originalname: 'test.txt',
                mimetype: 'text/plain',
                buffer: Buffer.from('test content'),
                size: 12,
            },
        }
        mockResponse = {
            status: jest.fn(() => mockResponse),
            send: jest.fn(),
            redirect: jest.fn(),
            render: jest.fn(),
        }

        jest.clearAllMocks()
    })

    describe('uploadFile', () => {
        test('should upload a file and redirect on success', async () => {
            mockRequest.params.folderId = 'folder-123'
            mockSupabaseUpload.mockResolvedValue({ data: { path: 'test.txt' }, error: null })
            mockSupabaseGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://test-url.com/test.txt' } })
            mockPrismaFolderUpdate.mockResolvedValue({})

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockSupabaseUpload).toHaveBeenCalledWith('test.txt', Buffer.from('test content'), expect.any(Object))
            expect(mockSupabaseGetPublicUrl).toHaveBeenCalledWith('test.txt')
            expect(mockPrismaFolderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'folder-123' },
                data: {
                    files: {
                        create: expect.objectContaining({
                            name: 'test.txt',
                            publicUrl: 'http://test-url.com/test.txt',
                            size: 12
                        })
                    }
                }
            }))
            expect(mockResponse.redirect).toHaveBeenCalledWith('/')
        })

        test('should return 400 if no file is received', async () => {
            mockRequest.file = undefined

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(400)
            expect(mockResponse.send).toHaveBeenCalledWith('No file data received.')
        })

        test('should return 500 if Supabase upload fails', async () => {
            mockRequest.params.folderId = 'folder-123'
            mockSupabaseUpload.mockResolvedValue({ data: null, error: { message: 'Supabase error' } })

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(500)
            expect(mockResponse.send).toHaveBeenCalledWith('File upload to Supabase failed.')
        })

        test('should return 500 if Prisma update fails after successful upload', async () => {
            mockRequest.params.folderId = 'folder-123'
            mockSupabaseUpload.mockResolvedValue({ data: { path: 'test.txt' }, error: null })
            mockSupabaseGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://test-url.com/test.txt' } })
            mockPrismaFolderUpdate.mockRejectedValue(new Error('Prisma error'))

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(500)
            expect(mockResponse.send).toHaveBeenCalledWith('Failed to update folder in database.')
        })

        test('should return 500 if file data is not accessible', async () => {
            mockRequest.file = {
                originalname: 'test.txt',
                mimetype: 'text/plain',
                size: 12
            }

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(500)
            expect(mockResponse.send).toHaveBeenCalledWith("Internal server error: File data not accessible.")
        })
    })

    describe('addFolder', () => {
        test('should add a new folder and redirect', async () => {
            mockRequest.body.newFolder = 'New Test Folder'
            mockPrismaUserUpdate.mockResolvedValue({})

            await contentController.addFolder(mockRequest, mockResponse, mockNext)

            expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
                where: { id: 'test-user-id' },
                data: {
                    folders: {
                        create: { name: 'New Test Folder' }
                    }
                }
            })
            expect(mockResponse.redirect).toHaveBeenCalledWith('/')
        })
    })

    describe('getEditFolder', () => {
        test('should render edit-folder view with folder data', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockFolder = { id: 'folder-456', name: 'Folder to Edit' }
            mockPrismaFolderFindFirst.mockResolvedValue(mockFolder)

            await contentController.getEditFolder(mockRequest, mockResponse)

            expect(mockPrismaFolderFindFirst).toHaveBeenCalledWith({
                where: { id: 'folder-456' }
            })
            expect(mockResponse.render).toHaveBeenCalledWith('edit-folder', { folder: mockFolder })
        })
    })

    describe('postEditFolder', () => {
        test('should update folder name and redirect', async () => {
            mockRequest.params.folderId = 'folder-456'
            mockRequest.body.editFolder = 'Updated Folder Name'
            mockPrismaFolderUpdate.mockResolvedValue({})

            await contentController.postEditFolder(mockRequest, mockResponse)

            expect(mockPrismaFolderUpdate).toHaveBeenCalledWith({
                where: { id: 'folder-456' },
                data: { name: 'Updated Folder Name' }
            })
            expect(mockResponse.redirect).toHaveBeenCalledWith('/')
        })
    })

    describe('deleteFolder', () => {
        test('should delete a folder and redirect', async () => {
            mockRequest.params.folderId = 'folder-456'
            mockPrismaFolderDelete.mockResolvedValue({})

            await contentController.deleteFolder(mockRequest, mockResponse)

            expect(mockPrismaFolderDelete).toHaveBeenCalledWith({
                where: { id: 'folder-456' }
            })
            expect(mockResponse.redirect).toHaveBeenCalledWith('/')
        })
    })

    describe('getFiles', () => {
        test('should render view-files with folder and file data', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockFolder = {
                id: 'folder-456',
                name: 'Files Folder',
                files: [{ id: 'file-1', name: 'file.pdf' }]
            }
            mockPrismaFolderFindFirst.mockResolvedValue(mockFolder)

            await contentController.getFiles(mockRequest, mockResponse)

            expect(mockPrismaFolderFindFirst).toHaveBeenCalledWith({
                where: { id: 'folder-456' },
                include: { files: true }
            })
            expect(mockResponse.render).toHaveBeenCalledWith('view-files', {
                folder: mockFolder,
                files: mockFolder.files
            })
        })
    })

    describe('getFileDetails', () => {
        test('should render file-details with file data', async () => {
            mockRequest.params.fileId = 'file-789'
            const mockFile = { id: 'file-789', name: 'details.txt', updloadedAt: new Date() }
            mockPrismaFileFindFirst.mockResolvedValue(mockFile)

            await contentController.getFileDetails(mockRequest, mockResponse)

            expect(mockPrismaFileFindFirst).toHaveBeenCalledWith({
                where: { id: 'file-789' }
            })
            expect(mockResponse.render).toHaveBeenCalledWith('file-details', {
                file: mockFile,
                date: JSON.stringify(mockFile.updloadedAt)
            })
        })
    })

    describe('deleteFile', () => {
        test('should delete a file and redirect', async () => {
            mockRequest.params.fileId = 'file-789'
            mockPrismaFileDelete.mockResolvedValue({})

            await contentController.deleteFile(mockRequest, mockResponse)

            expect(mockPrismaFileDelete).toHaveBeenCalledWith({
                where: { id: 'file-789' }
            })
            expect(mockResponse.redirect).toHaveBeenCalledWith('/')
        })
    })
})
