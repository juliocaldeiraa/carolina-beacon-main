import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Global validation pipe com class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // CORS — em produção aceita tudo (nginx já filtra origem)
  app.enableCors({ origin: true, credentials: true })

  // Health check
  const httpAdapter = app.getHttpAdapter()
  httpAdapter.get('/health', (_req: unknown, res: { send: (s: string) => void }) => res.send('ok'))

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  console.log(`Beacon API running on http://localhost:${port}`)
}

bootstrap()
