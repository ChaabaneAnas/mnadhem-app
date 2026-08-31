import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';
import { SecretCipherService } from './crypto/secret-cipher.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env['AUTH_SECRET'] ?? 'changeme-set-auth-secret-in-env',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [JwtGuard, SecretCipherService],
  exports: [JwtModule, JwtGuard, SecretCipherService],
})
export class CommonModule {}
