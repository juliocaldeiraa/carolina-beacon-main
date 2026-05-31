import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // O tenant padrão precisa ter o MESMO id que DEFAULT_TENANT_ID, pois os
  // fluxos não autenticados (inbound/webhook) usam essa env como fallback.
  const tenantId      = process.env.DEFAULT_TENANT_ID
  const adminEmail    = process.env.ADMIN_EMAIL    ?? 'admin@beacon.dev'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      ...(tenantId ? { id: tenantId } : {}),
      name: 'Demo Company',
      slug: 'demo',
      plan: 'pro',
    },
  })

  console.log(`✅ Tenant criado: ${tenant.name} (${tenant.id})`)

  // Cria o usuário admin
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  })

  console.log(`✅ Usuário criado: ${user.email}`)
  console.log('')
  console.log('─────────────────────────────────')
  console.log(`  Login:   ${adminEmail}`)
  console.log('  Senha:   (definida via ADMIN_PASSWORD)')
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
