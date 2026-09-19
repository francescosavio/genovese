import { Button } from '@/components/ui/button'

export default function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Genovese</h1>
        <p className="text-muted-foreground">
          Reads your bank exports and shows where the money goes. Nothing leaves
          this browser.
        </p>
      </div>
      <div>
        <Button>Load demo data</Button>
      </div>
    </main>
  )
}
