import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Cria o tenant demo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo',
      plan: 'pro',
    },
  })

  console.log(`✅ Tenant criado: ${tenant.name} (${tenant.id})`)

  // Cria o usuário admin
  const passwordHash = await bcrypt.hash('admin123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@beacon.dev' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@beacon.dev',
      passwordHash,
      role: 'ADMIN',
    },
  })

  console.log(`✅ Usuário criado: ${user.email}`)
  console.log('')
  console.log('─────────────────────────────────')
  console.log('  Login:   admin@beacon.dev')
  console.log('  Senha:   admin123')
  console.log('─────────────────────────────────')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
