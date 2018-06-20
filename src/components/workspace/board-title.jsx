import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import BoardTitleInput from './board-title-input'
import InvitationsView from '../../invitations-view'
import { parseDocumentLink } from '../../share-link'
import Omnibox from './omnibox'

const log = Debug('pushpin:board-title')

export default class BoardTitle extends React.PureComponent {
  static propTypes = {
    docId: PropTypes.string.isRequired,
    openDoc: PropTypes.func.isRequired
  }

  state = {
    invitations: [],
    activeOmnibox: false,
    activeTitleEditor: false,
    search: '',
    selected: null
  }

  omniboxInput = React.createRef()
  titleInput = React.createRef()

  // This is the New Boilerplate
  componentDidMount = () => {
    this.refreshHandle(this.props.docId)
    this.invitationsView = new InvitationsView(this.props.docId)
    this.invitationsView.onChange(this.onInvitationsChange)
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('click', this.handleClickOutside)
  }

  componentWillUnmount = () => {
    window.hm.releaseHandle(this.handle)
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('click', this.handleClickOutside)
  }

  componentDidUpdate = (prevProps, prevState, snapshot) => {
    if (prevProps.docId !== this.props.docId) {
      this.refreshHandle(this.props.docId)
    }
  }

  onInvitationsChange = (invitations) => {
    log('invitations change')
    this.setState({ invitations }, () => this.forceUpdate())
  }

  onKeyDown = (e) => {
    if (e.key === '/' && document.activeElement === document.body) {
      if (!this.state.activeOmnibox) {
        this.activateOmnibox()
        e.preventDefault()
      }
    }
    if (e.key === 'Escape' && this.state.activeOmnibox) {
      this.deactivateOmnibox()
      e.preventDefault()
    }
  }

  refreshHandle = (docId) => {
    if (this.handle) {
      window.hm.releaseHandle(this.handle)
    }
    this.handle = window.hm.openHandle(docId)
    this.handle.onChange(this.onChange)
  }

  refreshBoardHandle = (boardId) => {
    if (this.boardHandle) {
      window.hm.releaseHandle(this.boardHandle)
    }

    this.boardHandle = window.hm.openHandle(boardId)
    this.boardHandle.onChange((doc) => {
      this.setState({ board: doc })
    })
  }

  onChange = (doc) => {
    this.setState({ ...doc }, () => {
      if (this.state.currentDocUrl) {
        const { docId } = parseDocumentLink(this.state.currentDocUrl)

        if (!this.state.board || this.state.board.docId !== docId) {
          this.refreshBoardHandle(docId)
        }
      }
    })
  }

  activateOmnibox = () => {
    this.setState({ activeOmnibox: true }, () => {
      this.omniboxInput.current.focus()
    })
  }

  deactivateOmnibox = () => {
    this.setState({ activeOmnibox: false, search: '' })
  }

  handleChange = (e) => {
    this.setState({ search: e.target.value })
  }

  handleCommandKeys = (e) => {
    if (e.key === 'ArrowDown') {
      const selected = this.omniboxControl.moveDown()
      this.setState({ selected })
    }

    if (e.key === 'ArrowUp') {
      const selected = this.omniboxControl.moveUp()
      this.setState({ selected })
    }

    if (e.key === 'Enter') {
      const { selected } = this.state

      if (this.state.selected.type === 'contact') {
        this.offerDocumentToIdentity(this.state.selected.id)
      } else if (this.state.selected.url) {
        this.props.openDoc(selected.url)
      }

      this.deactivateOmnibox()
    }
  }

  handleClickOutside = (e) => {
    if (e.target.className !== 'TitleBar__titleText') {
      this.deactivateOmnibox()
    }

    if ((e.target.className !== 'TitleBar__titleText') &&
        (e.target.className !== 'fa fa-edit')) {
      this.setState({ activeTitleEditor: false })
    }
  }

  handleTitleClick = (e) => {
    if (!this.state.activeTitleEditor) {
      this.activateOmnibox()
    }
  }

  activateTitleEditor = () => {
    this.setState({ activeTitleEditor: true })
  }

  updateTitle = (value) => {
    this.boardHandle.change((doc) => {
      doc.title = value
    })

    this.setState({ activeTitleEditor: false })
  }

  cancelTitleEdit = () => {
    this.setState({ activeTitleEditor: false })
  }

  setOmniboxControl = (controller) => {
    this.omniboxControl = controller
  }

  offerDocumentToIdentity = (contactId) => {
    if (!this.state.selfId) {
      return
    }

    const selfHandle = window.hm.openHandle(this.state.selfId)

    selfHandle.change((s) => {
      if (!s.offeredUrls) {
        s.offeredUrls = {}
      }

      if (!s.offeredUrls[contactId]) {
        s.offeredUrls[contactId] = []
      }

      if (!s.offeredUrls[contactId].includes(this.state.currentDocUrl)) {
        s.offeredUrls[contactId].push(this.state.currentDocUrl)
      }
    })

    window.hm.releaseHandle(selfHandle)
  }

  render = () => {
    log('render')

    if (!this.state.currentDocUrl) {
      return null
    }

    const { viewedDocUrls } = this.state
    const invitations = this.state.invitations.filter((i) => (
      !viewedDocUrls.some(url => url === i.documentUrl)
    ))

    let inputBar
    if (this.state.activeOmnibox) {
      inputBar = (
        <input
          ref={this.omniboxInput}
          type="text"
          className="TitleBar__titleText BoardTitle__omniboxInput"
          onChange={this.handleChange}
          onKeyDown={this.handleCommandKeys}
          placeholder="Start typing..."
        />
      )
    } else {
      const { titleEditor } = this.state

      let invitationsClasses = 'fa fa-envelope'
      if (invitations.length === 0) {
        invitationsClasses += ' hidden'
      }

      inputBar = (
        <div className="BoardTitle__actionBar">
          <div className="BoardTitle__actionBar__left">
            <i className={invitationsClasses} onClick={this.activateOmnibox} />
          </div>
          <BoardTitleInput
            active={this.state.activeTitleEditor}
            onSubmit={this.updateTitle}
            onCancel={this.cancelTitleEdit}
            defaultValue={this.state.board && this.state.board.title}
            onClick={this.activateOmnibox}
          />
          <div className="BoardTitle__actionBar__right">
            <i className="fa fa-edit" onClick={this.activateTitleEditor} />
            <CopyToClipboard text={this.state.currentDocUrl}>
              <i className="fa fa-clipboard" />
            </CopyToClipboard>
          </div>
        </div>
      )
    }

    return (
      <div ref={(ref) => { this.omniboxRef = ref }} className="BoardTitle">
        { inputBar }
        <Omnibox
          docId={this.props.docId}
          visible={this.state.activeOmnibox}
          search={this.state.search}
          getKeyController={this.setOmniboxControl}
          invitations={invitations}
        />
      </div>
    )
  }
}
