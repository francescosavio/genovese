import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { db } from '@/storage/db'

export function ClearDataButton({
  disabled,
  onCleared,
}: {
  disabled: boolean
  onCleared: () => void
}) {
  // AlertDialogAction does not close on its own, so the dialog stays open
  // until the data is actually gone.
  const [open, setOpen] = useState(false)

  async function clear() {
    await db.transactions.clear()
    setOpen(false)
    onCleared()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" disabled={disabled}>
            Clear
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear everything in this browser?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes every transaction and the categories assigned to them.
            Anything you have not exported to a spreadsheet is gone for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              void clear()
            }}
          >
            Clear everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
