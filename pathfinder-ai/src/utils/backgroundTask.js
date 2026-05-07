// Tiny module-level promise registry so long-running API calls survive when the
// user navigates away from the page that started them. Each task is keyed by a
// stable string (e.g. "career-insights"); the promise itself + a status snapshot
// live in module scope, untouched by React's mount/unmount cycle.
//
// Usage from a page:
//   const task = startTask(KEY, () => api.post(...).then(r => r.data))
//   subscribeTask(KEY, snapshot => updateMyComponentState(snapshot))
// On mount, peekTask(KEY) tells you whether to show idle / loading / result.

const tasks = new Map() // key -> { status, data, error, promise, listeners:Set }

function notify(task) {
  task.listeners.forEach(fn => {
    try { fn(snapshot(task)) } catch { /* swallow listener errors */ }
  })
}

function snapshot(task) {
  return { status: task.status, data: task.data, error: task.error }
}

// Start a new task or return the in-flight one if its key already exists.
// `runFn` is only invoked when there's no existing pending task for this key.
export function startTask(key, runFn) {
  const existing = tasks.get(key)
  if (existing && existing.status === 'pending') return existing.promise

  const task = {
    status: 'pending',
    data: null,
    error: null,
    listeners: new Set(),
    promise: null,
  }
  tasks.set(key, task)

  task.promise = runFn()
    .then(data => {
      task.status = 'done'
      task.data = data
      notify(task)
      return data
    })
    .catch(error => {
      task.status = 'error'
      task.error = error
      notify(task)
      throw error
    })

  return task.promise
}

// Subscribe to status changes for a task. Returns an unsubscribe function.
// If the task already exists, the listener fires immediately with its current
// snapshot so the component can render correctly on first paint.
export function subscribeTask(key, fn) {
  const task = tasks.get(key)
  if (!task) return () => {}
  task.listeners.add(fn)
  // Fire current state immediately so newly mounted components hydrate.
  fn(snapshot(task))
  return () => task.listeners.delete(fn)
}

// Read the current snapshot without subscribing.
export function peekTask(key) {
  const task = tasks.get(key)
  return task ? snapshot(task) : null
}

// Drop a finished or stale task. Pending tasks should generally be allowed
// to finish (they continue on the network either way), but call this to
// reset state when the user starts a new request from scratch.
export function clearTask(key) {
  const task = tasks.get(key)
  if (!task) return
  if (task.status === 'pending') return // don't drop in-flight tasks
  tasks.delete(key)
}
