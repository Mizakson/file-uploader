import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
// use `prisma` in your application to read and write data in your DB

async function main() {
    const user = await prisma.user.findUnique({
        where: {
            name: "jmama"
        },
        select: {
            folders: {
                where: {
                    name: 'aasdasd'
                }
            }
        }
    })
    // const user = await prisma.user.deleteMany()

    // const folder = await prisma.folder.findFirst()

    // console.log(folder)
    console.log(user)
}

main()
    .catch(e => {
        console.error(e.message)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })