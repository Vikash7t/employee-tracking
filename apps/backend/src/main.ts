import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';
import { validateEnvironment } from './common/config/env-validator';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// Fail-fast environment validation
validateEnvironment();

async function bootstrap(): Promise<void> {
  const logger = new AppLogger();
  const app = await NestFactory.create(AppModule, { logger });

  // OWASP API8: Security Misconfiguration - Helmet headers
  app.use(
    helmet({
      frameguard: { action: 'deny' },
      contentSecurityPolicy: false, // Swagger UI compatibility
      crossOriginEmbedderPolicy: false,
    }),
  );

  // OWASP API4: Payload size limiting
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // OWASP API3: BOPLA / Mass Assignment prevention via ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS Configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Workforce Attendance & Geospatial Tracking API')
    .setDescription('Authoritative backend for geofenced attendance, worksites, and compliance auditing.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 NestJS Backend running at http://localhost:${port}`);
  logger.log(`📚 Swagger documentation at http://localhost:${port}/api/docs`);
}

bootstrap();
