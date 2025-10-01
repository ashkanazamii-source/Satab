// sim800.module.ts
import { Module } from '@nestjs/common';
import { Sim800Controller } from './sim800.controller';

@Module({ controllers: [Sim800Controller] })
export class Sim800Module {}
