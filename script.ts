import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
// use `prisma` in your application to read and write data in your DB

async function main() {
    const files = await prisma.folder.findFirst({
        where: {
            name: "hifolder"
        },
        include: {
            files: true
        }
    })

    console.log(files)
}

main()
    .catch(e => {
        console.error(e.message)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })