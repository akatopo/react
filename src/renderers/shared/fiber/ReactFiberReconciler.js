/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactFiberReconciler
 * @flow
 */

'use strict';

import type { Fiber } from 'ReactFiber';
import type { FiberRoot } from 'ReactFiberRoot';
import type { TypeOfWork } from 'ReactTypeOfWork';
import type { PriorityLevel } from 'ReactPriorityLevel';

var { createFiberRoot } = require('ReactFiberRoot');
var ReactFiberScheduler = require('ReactFiberScheduler');

if (__DEV__) {
  var ReactFiberInstrumentation = require('ReactFiberInstrumentation');
}

var { findCurrentHostFiber } = require('ReactFiberTreeReflection');

type Deadline = {
  timeRemaining : () => number
};

type HostChildNode<I> = { tag: TypeOfWork, output: HostChildren<I>, sibling: any };

export type HostChildren<I> = null | void | I | HostChildNode<I>;

export type HostConfig<T, P, I, TI, C> = {

  // TODO: We don't currently have a quick way to detect that children didn't
  // reorder so we host will always need to check the set. We should make a flag
  // or something so that it can bailout easily.

  updateContainer(containerInfo : C, children : HostChildren<I | TI>) : void,

  createInstance(type : T, props : P, children : HostChildren<I | TI>) : I,
  prepareUpdate(instance : I, oldProps : P, newProps : P) : boolean,
  commitUpdate(instance : I, oldProps : P, newProps : P) : void,

  createTextInstance(text : string) : TI,
  commitTextUpdate(textInstance : TI, oldText : string, newText : string) : void,

  appendChild(parentInstance : I, child : I | TI) : void,
  insertBefore(parentInstance : I, child : I | TI, beforeChild : I | TI) : void,
  removeChild(parentInstance : I, child : I | TI) : void,

  scheduleAnimationCallback(callback : () => void) : void,
  scheduleDeferredCallback(callback : (deadline : Deadline) => void) : void

};

type OpaqueNode = Fiber;

export type Reconciler<C, I, TI> = {
  mountContainer(element : ReactElement<any>, containerInfo : C) : OpaqueNode,
  updateContainer(element : ReactElement<any>, container : OpaqueNode) : void,
  unmountContainer(container : OpaqueNode) : void,
  performWithPriority(priorityLevel : PriorityLevel, fn : Function) : void,

  // Used to extract the return value from the initial render. Legacy API.
  getPublicRootInstance(container : OpaqueNode) : (ReactComponent<any, any, any> | TI | I | null),

  // Use for findDOMNode/findHostNode. Legacy API.
  findHostInstance(component : ReactComponent<any, any, any>) : I | TI | null,
};

module.exports = function<T, P, I, TI, C>(config : HostConfig<T, P, I, TI, C>) : Reconciler<C, I, TI> {

  var { scheduleWork, performWithPriority } = ReactFiberScheduler(config);

  return {

    mountContainer(element : ReactElement<any>, containerInfo : C) : OpaqueNode {
      const root = createFiberRoot(containerInfo);
      const container = root.current;
      // TODO: Use pending work/state instead of props.
      // TODO: This should not override the pendingWorkPriority if there is
      // higher priority work in the subtree.
      container.pendingProps = element;

      scheduleWork(root);

      if (__DEV__ && ReactFiberInstrumentation.debugTool) {
        ReactFiberInstrumentation.debugTool.onMountContainer(root);
      }

      // It may seem strange that we don't return the root here, but that will
      // allow us to have containers that are in the middle of the tree instead
      // of being roots.
      return container;
    },

    updateContainer(element : ReactElement<any>, container : OpaqueNode) : void {
      // TODO: If this is a nested container, this won't be the root.
      const root : FiberRoot = (container.stateNode : any);
      // TODO: Use pending work/state instead of props.
      root.current.pendingProps = element;

      scheduleWork(root);

      if (__DEV__ && ReactFiberInstrumentation.debugTool) {
        ReactFiberInstrumentation.debugTool.onUpdateContainer(root);
      }
    },

    unmountContainer(container : OpaqueNode) : void {
      // TODO: If this is a nested container, this won't be the root.
      const root : FiberRoot = (container.stateNode : any);
      // TODO: Use pending work/state instead of props.
      root.current.pendingProps = [];

      scheduleWork(root);

      if (__DEV__ && ReactFiberInstrumentation.debugTool) {
        ReactFiberInstrumentation.debugTool.onUnmountContainer(root);
      }
    },

    performWithPriority,

    getPublicRootInstance(container : OpaqueNode) : (ReactComponent<any, any, any> | I | TI | null) {
      const root : FiberRoot = (container.stateNode : any);
      const containerFiber = root.current;
      if (!containerFiber.child) {
        return null;
      }
      return containerFiber.child.stateNode;
    },

    findHostInstance(component : ReactComponent<any, any, any>) : I | TI | null {
      const fiber = findCurrentHostFiber(component);
      if (!fiber) {
        return null;
      }
      return fiber.stateNode;
    },

  };

};
