import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env['AUTH_SECRET'] ?? 'changeme-set-auth-secret-in-env',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [JwtGuard],
  exports: [JwtModule, JwtGuard],
})
export class CommonModule {}
