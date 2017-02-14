const sampleFiles = [
  {
    icon: 'level-up',
    name: '..',
    size: '<DIR>',
    date: '02/08/2017 00:10',
    mode: '0755'
  },
  {
    icon: 'file-text',
    name: 'clan in da front.txt',
    size: '4,110',
    date: '02/01/2017 00:07',
    mode: '0644'
  }
]

export default class MockConnection {
  static canHandle (path) {
    return true
  }

  constructor (window) {
    this.view = this.view.bind(this)
    this.editor = this.editor.bind(this)
    this.cp = this.cp.bind(this)
    this.mv = this.mv.bind(this)
    this.mkdir = this.mkdir.bind(this)
    this.touch = this.touch.bind(this)
    this.rm = this.rm.bind(this)
    this.ls = this.ls.bind(this)
    this.cd = this.cd.bind(this)
    this.cdDirname = this.cdDirname.bind(this)
    this.cancel = this.cancel.bind(this)
    this.defer = this.defer.bind(this)

    this.root = { children: {} }
    this.ready = false
    this.window = window
  }

  async init () {
    await this.mkdir('/c')
    await this.mkdir('/c/Users')
    await this.mkdir('/c/Users/D')
    await this.mkdir('/c/Users/D/Music')
    await this.touch('/c/Users/D/Music/clan in da front.txt')
    this.ready = true
  }

  canHandle (path) {
    return true
  }

  view (path) {
    const desc = 'Viewing ' + path
    const promise = this.defer(desc)

    return {
      type: 'view',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  editor (path) {
    const desc = 'Editing ' + path
    const promise = this.defer(desc)

    return {
      type: 'editor',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  cp (path, nextPath) {
    const desc = 'Copying ' + path + ' to ' + nextPath

    const x = this.cdDirname(path)
    const parent = x.parent
    const name = x.name

    const y = this.cdDirname(nextPath)
    const nextParent = y.parent
    const nextName = y.name

    nextParent.children[nextName] = { ...parent.children[name],
      name: y.name
    }

    const promise = Promise.resolve()

    return {
      type: 'cp',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  mv (path, nextPath) {
    const desc = 'Moving ' + path + ' to ' + nextPath

    const promise = this.cp(path, nextPath).then(() => {
      this.rm(path)
    })

    return {
      type: 'mv',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  mkdir (path) {
    const desc = 'Creating directory ' + path

    const { parent, name } = this.cdDirname(path)

    const dir = { ...sampleFiles[0],
      icon: 'folder',
      name: name,
      children: {}
    }

    dir.children['..'] = { ...sampleFiles[0] }

    parent.children[name] = dir

    const promise = Promise.resolve()

    return {
      type: 'mkdir',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  touch (path) {
    const desc = 'Touching ' + path

    const { parent, name } = this.cdDirname(path)

    const file = { ...sampleFiles[1],
      name: name
    }

    parent.children[name] = file

    const promise = Promise.resolve()

    return {
      type: 'touch',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  rm (path) {
    const desc = 'Removing ' + path

    const { parent, name } = this.cdDirname(path)
    delete parent.children[name]

    const promise = Promise.resolve()

    return {
      type: 'rm',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  ls (path) {
    const desc = 'Listing ' + path

    const current = this.cd(path)

    const children = Object.keys(current.children).map(x => {
      return { ...current.children[x],
        children: undefined
      }
    })

    const promise = Promise.resolve(children)

    return {
      type: 'ls',
      uuid: this.uuid(),
      desc,
      progress: this.progress,
      cancel: this.cancel,
      catch: promise.catch.bind(promise),
      then: promise.then.bind(promise)
    }
  }

  cd (path) {
    const parts = path.split('/')
    const dirs = parts.slice(1)
    let current = this.root

    dirs.forEach((part, i) => {
      current = current.children[part]
    })

    return current
  }

  cdDirname (path) {
    const parts = path.split('/')
    const dirs = parts.slice(1, -1)
    let current = this.root

    dirs.forEach((part, i) => {
      current = current.children[part]
    })

    return {
      parent: current,
      name: parts.slice(-1)[0]
    }
  }

  progress () {
    return 0.5
  }

  cancel () {
    return this.defer('Cancelled')
  }

  defer (msg) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
        this.window.alert(msg)
      }, 500)
    })
  }

  // http://stackoverflow.com/questions/105034/ddg#2117523
  uuid () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8) // eslint-disable-line no-mixed-operators
      return v.toString(16)
    })
  }
}