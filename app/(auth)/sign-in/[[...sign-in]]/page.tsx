import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--surface)' }}>
      <SignIn />
    </div>
  )
}
