const { PrismaClient } = require('@prisma/client')
console.log('Imported successfully')
try {
    const prisma = new PrismaClient()
    console.log('Initialized successfully')
} catch (e) {
    console.error('Initialization failed:', e)
}
