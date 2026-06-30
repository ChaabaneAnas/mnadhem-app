import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub?: string;
  userId?: string;
  activeTenantId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: { userId: string; tenantId: string };
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearer(req);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const userId = payload.userId ?? payload.sub;
      const tenantId = payload.activeTenantId;
      if (!userId || !tenantId) throw new Error('missing claims');
      req.user = { userId, tenantId };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractBearer(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
