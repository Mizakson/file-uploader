// create mocks first, then import controller
const mockCreateSignedUrl = jest.fn()
const mockPipe = jest.fn()
const mockSetHeader = jest.fn()

jest.mock('stream', () => ({
    Readable: {
        fromWeb: jest.fn(() => ({
            pipe: mockPipe,
        })),
    },
}))

const fetch = jest.fn()
global.fetch = fetch

jest.mock('../prisma/prisma', () => ({
    user: {
        findUnique: jest.fn(),
    },
    folder: {
        findFirst: jest.fn(),
    },
    file: {
        findUnique: jest.fn(),
    },
}))

jest.mock('passport', () => ({
    authenticate: jest.fn(() => (req, res, next) => { }),
}))

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        storage: {
            from: jest.fn(() => ({
                createSignedUrl: mockCreateSignedUrl,
            })),
        },
    })),
}))

const indexController = require('../controllers/indexController')
const prisma = require('../prisma/prisma')
const passport = require('passport')


describe('indexController', () => {
    let mockResponse
    let mockRequest
    const mockNext = jest.fn()

    beforeEach(() => {
        mockResponse = {
            render: jest.fn(),
            redirect: jest.fn(),
            status: jest.fn(() => mockResponse),
            send: jest.fn(),
            setHeader: mockSetHeader,
            locals: {
                currentUser: { id: 'test-user-id' }
            }
        }

        mockRequest = {
            isAuthenticated: jest.fn(),
            logout: jest.fn((cb) => cb(null)), // mock logout for its callback
            params: {},
            body: {}
        }
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    // tests for postLogin are (isolated)
    // reason: not altered by beforeEach/afterEach hooks
    describe('postLogin', () => {
        test('should call passport.authenticate with correct options', () => {
            expect(passport.authenticate).toHaveBeenCalledWith('local', {
                successRedirect: '/',
                failureRedirect: '/',
            })
        })
    })

    describe('remaining indexController methods', () => {

        describe('getIndex', () => {
            test('should redirect to /login if user is not authenticated', async () => {
                mockRequest.isAuthenticated.mockReturnValue(false)

                await indexController.getIndex(mockRequest, mockResponse)

                expect(mockRequest.isAuthenticated).toHaveBeenCalled()
                expect(mockResponse.redirect).toHaveBeenCalledWith('/login')
                expect(prisma.user.findUnique).not.toHaveBeenCalled()
            })

            test('should render the index view with user data if authenticated', async () => {
                mockRequest.isAuthenticated.mockReturnValue(true)
                const mockFolders = [{ id: 'folder1', name: 'Folder 1' }]
                prisma.user.findUnique.mockResolvedValue({ folders: mockFolders })

                await indexController.getIndex(mockRequest, mockResponse, mockNext)

                expect(mockRequest.isAuthenticated).toHaveBeenCalled()
                expect(prisma.user.findUnique).toHaveBeenCalledWith({
                    where: { id: 'test-user-id' },
                    include: { folders: true },
                })
                expect(mockResponse.render).toHaveBeenCalledWith('index', {
                    user: mockResponse.locals.currentUser,
                    folders: mockFolders,
                })
            })

            test('should call next with an error if prisma fails', async () => {
                mockRequest.isAuthenticated.mockReturnValue(true)
                const mockError = new Error('Database connection failed')
                prisma.user.findUnique.mockRejectedValue(mockError)

                await indexController.getIndex(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.render).not.toHaveBeenCalled()
            })
        })

        describe('getSignUp', () => {
            test('should render the sign-up view', () => {
                indexController.getSignUp(mockRequest, mockResponse)
                expect(mockResponse.render).toHaveBeenCalledWith('sign-up', {
                    user: mockResponse.locals.currentUser,
                })
            })
        })

        describe('getLogin', () => {
            test('should render the login view', () => {
                indexController.getLogin(mockRequest, mockResponse)
                expect(mockResponse.render).toHaveBeenCalledWith('login', {
                    user: mockResponse.locals.currentUser,
                })
            })
        })

        describe('getLogout', () => {
            test('should log out the user and redirect to home', () => {
                indexController.getLogout(mockRequest, mockResponse, mockNext)
                expect(mockRequest.logout).toHaveBeenCalled()
                expect(mockResponse.redirect).toHaveBeenCalledWith('/')
            })

            test('should call next with an error if logout fails', () => {
                const mockError = new Error('Logout failed')
                mockRequest.logout.mockImplementationOnce((cb) => cb(mockError))
                indexController.getLogout(mockRequest, mockResponse, mockNext)
                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.redirect).not.toHaveBeenCalled()
            })
        })

        describe('getAddFolder', () => {
            test('should render the add-folder view', () => {
                indexController.getAddFolder(mockRequest, mockResponse)
                expect(mockResponse.render).toHaveBeenCalledWith('add-folder')
            })
        })

        describe('getUploadFile', () => {
            test('should render the file-upload view with folder data', async () => {
                mockRequest.params.folderId = 'folder-123'
                const mockFolder = { id: 'folder-123', name: 'Test Folder' }
                prisma.folder.findFirst.mockResolvedValue(mockFolder)

                await indexController.getUploadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.folder.findFirst).toHaveBeenCalledWith({
                    where: { id: 'folder-123' },
                })
                expect(mockResponse.render).toHaveBeenCalledWith('file-upload', {
                    folder: mockFolder,
                })
            })

            test('should render error-page with 404 status if folder is not found', async () => {
                mockRequest.params.folderId = 'non-existent-folder'
                prisma.folder.findFirst.mockResolvedValue(null)

                await indexController.getUploadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.folder.findFirst).toHaveBeenCalled()
                expect(mockResponse.status).toHaveBeenCalledWith(404)
                expect(mockResponse.render).toHaveBeenCalledWith('error-page', { message: 'Folder not found.' })
            })

            test('should call next with an error if prisma fails', async () => {
                mockRequest.params.folderId = 'folder-123'
                const mockError = new Error('Database error')
                prisma.folder.findFirst.mockRejectedValue(mockError)

                await indexController.getUploadFile(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.render).not.toHaveBeenCalled()
            })
        })

        describe('getDownloadFile', () => {
            test('should stream the file and set the correct headers if the file is found', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }
                const mockSignedUrl = 'http://test-url.com/signed'
                const mockWebReadableStream = { body: {} }

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockResolvedValue({
                    data: { signedUrl: mockSignedUrl },
                    error: null,
                })

                fetch.mockResolvedValue({
                    ok: true,
                    body: mockWebReadableStream,
                })

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalledWith({
                    where: { id: 'file-456' },
                    select: { name: true, folderId: true },
                })
                expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
                expect(fetch).toHaveBeenCalledWith(mockSignedUrl)
                expect(mockSetHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment filename="test.pdf"')
                expect(require('stream').Readable.fromWeb).toHaveBeenCalledWith(mockWebReadableStream)
                expect(mockPipe).toHaveBeenCalledWith(mockResponse)
            })

            test('should render error-page with 404 status if the file is not found in the database', async () => {
                mockRequest.params.fileId = 'non-existent-file'
                prisma.file.findUnique.mockResolvedValue(null)

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalled()
                expect(mockResponse.status).toHaveBeenCalledWith(404)
                expect(mockResponse.render).toHaveBeenCalledWith('error-page', { message: "File not found in our records." })
            })

            test('should render error-page with 500 status if an error occurs while generating the signed URL', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockResolvedValue({
                    data: null,
                    error: { message: 'Supabase error' },
                })

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalled()
                expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
                expect(mockResponse.status).toHaveBeenCalledWith(500)
                expect(mockResponse.render).toHaveBeenCalledWith('error-page', { message: "Failed to generate download link." })
            })

            test('should render error-page with 500 status if the fetch call fails', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }
                const mockSignedUrl = 'http://test-url.com/signed'

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockResolvedValue({
                    data: { signedUrl: mockSignedUrl },
                    error: null,
                })

                fetch.mockResolvedValue({
                    ok: false,
                    statusText: 'Not Found',
                })

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalled()
                expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
                expect(fetch).toHaveBeenCalledWith(mockSignedUrl)
                expect(mockResponse.status).toHaveBeenCalledWith(500)
                expect(mockResponse.render).toHaveBeenCalledWith('error-page', { message: "Failed to fetch file for download." })
            })

            test('should call next with an error if an unexpected error occurs', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }
                const mockError = new Error('Unexpected database error')

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockRejectedValue(mockError)

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.render).not.toHaveBeenCalled()
            })
        })
    })
})
