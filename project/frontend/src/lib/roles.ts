export type Role = 'customer' | 'agent' | 'reviewer' | 'manager' | 'admin'

export function getHomePath(role?: string | null): string {
  switch (role) {
    case 'admin':
    case 'manager':
      return '/admin/dashboard'
    case 'agent':
      return '/agent/dashboard'
    case 'reviewer':
      return '/reviewer/queue'
    case 'customer':
      return '/customer/dashboard'
    default:
      return '/login'
  }
}

export const ALL_ROLES: Role[] = ['customer', 'agent', 'reviewer', 'manager', 'admin']
