/**
 * CleverScript stub — div[data-relay-park-native=fb-live-chat].
 * Shared across parked sites; hosts load from content repo or relay-web-assets.
 */
import React from 'react'

export default function LiveChat(props) {
  const p = props || {}
  let channel = ''
  if (p.channel !== null && p.channel !== undefined && ('' + p.channel).length > 0) {
    channel = '' + p.channel
  }
  let path = '/'
  if (p.path !== null && p.path !== undefined && ('' + p.path).length > 0) {
    path = '' + p.path
  }
  let mode = 'embed'
  if (p.mode !== null && p.mode !== undefined && ('' + p.mode).length > 0) {
    mode = '' + p.mode
  }
  let prefix = ''
  if (p.prefix !== null && p.prefix !== undefined && ('' + p.prefix).length > 0) {
    prefix = '' + p.prefix
  }
  let origin = ''
  if (p.origin !== null && p.origin !== undefined && ('' + p.origin).length > 0) {
    origin = '' + p.origin
  } else if (
    p.chatOrigin !== null &&
    p.chatOrigin !== undefined &&
    ('' + p.chatOrigin).length > 0
  ) {
    origin = '' + p.chatOrigin
  }
  const attrs = {
    className: 'fb-live-chat-host',
    'data-relay-park-native': 'fb-live-chat',
    'data-path': path,
    'data-mode': mode,
  }
  if (channel) attrs['data-channel'] = channel
  if (prefix) attrs['data-prefix'] = prefix
  if (origin) attrs['data-chat-origin'] = origin
  return <div {...attrs} />
}
