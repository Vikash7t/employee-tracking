import { Injectable, Logger } from '@nestjs/common';
import { GeofencePresenceOutcome, WorkplacePresenceStatus } from '@employee-tracking/contracts';

export type StateMachineAction =
  | 'NO_CHANGE'
  | 'START_EXIT_GRACE'
  | 'CANCEL_EXIT_GRACE'
  | 'CONFIRM_EXIT'
  | 'REENTERED_WORKSITE';

export interface StateMachineTransitionResult {
  nextPresenceStatus: WorkplacePresenceStatus;
  action: StateMachineAction;
  exitPendingSince: Date | null;
  exitGraceExpiresAt: Date | null;
  accumulatedInsideSeconds: number;
  accumulatedOutsideSeconds: number;
}

export interface TransitionContext {
  currentPresenceStatus: WorkplacePresenceStatus;
  exitPendingSince: Date | null;
  exitGraceExpiresAt: Date | null;
  lastEvaluatedAt: Date;
  gracePeriodSeconds: number;
}

@Injectable()
export class AttendanceStateMachineService {
  private readonly logger = new Logger(AttendanceStateMachineService.name);

  /**
   * Deterministically transitions workplace presence based on spatial observation,
   * persisted grace deadlines, and elapsed time (Master Plan Section 8.4).
   */
  evaluateTransition(
    context: TransitionContext,
    outcome: GeofencePresenceOutcome,
    eventTimestamp: Date,
  ): StateMachineTransitionResult {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((eventTimestamp.getTime() - context.lastEvaluatedAt.getTime()) / 1000),
    );

    let nextPresenceStatus = context.currentPresenceStatus;
    let action: StateMachineAction = 'NO_CHANGE';
    let exitPendingSince = context.exitPendingSince;
    let exitGraceExpiresAt = context.exitGraceExpiresAt;
    let accumulatedInsideSeconds = 0;
    let accumulatedOutsideSeconds = 0;

    // Attribute elapsed time to current status
    if (context.currentPresenceStatus === 'INSIDE' || context.currentPresenceStatus === 'EXIT_PENDING') {
      accumulatedInsideSeconds = elapsedSeconds;
    } else if (context.currentPresenceStatus === 'OUTSIDE') {
      accumulatedOutsideSeconds = elapsedSeconds;
    }

    if (outcome === 'INSIDE') {
      if (context.currentPresenceStatus === 'EXIT_PENDING') {
        // Employee returned to worksite before grace expired
        nextPresenceStatus = 'INSIDE';
        action = 'CANCEL_EXIT_GRACE';
        exitPendingSince = null;
        exitGraceExpiresAt = null;
      } else if (context.currentPresenceStatus === 'OUTSIDE') {
        // Confirmed return after being outside
        nextPresenceStatus = 'INSIDE';
        action = 'REENTERED_WORKSITE';
        exitPendingSince = null;
        exitGraceExpiresAt = null;
      } else if (context.currentPresenceStatus === 'UNCERTAIN') {
        nextPresenceStatus = 'INSIDE';
        action = 'NO_CHANGE';
      }
    } else if (outcome === 'OUTSIDE') {
      if (context.currentPresenceStatus === 'INSIDE') {
        // First observation outside worksite -> initiate grace period
        nextPresenceStatus = 'EXIT_PENDING';
        action = 'START_EXIT_GRACE';
        exitPendingSince = eventTimestamp;
        exitGraceExpiresAt = new Date(
          eventTimestamp.getTime() + context.gracePeriodSeconds * 1000,
        );
      } else if (context.currentPresenceStatus === 'EXIT_PENDING') {
        // Still outside. Check if grace timer has expired
        if (context.exitGraceExpiresAt && eventTimestamp >= context.exitGraceExpiresAt) {
          nextPresenceStatus = 'OUTSIDE';
          action = 'CONFIRM_EXIT';
          exitPendingSince = null;
          exitGraceExpiresAt = null;
        } else {
          // Grace still active
          action = 'NO_CHANGE';
        }
      }
    } else {
      // outcome === 'UNCERTAIN': Do not trigger exit or exit confirmation on noisy/jitter fixes
      if (context.currentPresenceStatus === 'EXIT_PENDING' && context.exitGraceExpiresAt) {
        // If already pending exit, do not confirm exit on uncertain fix
        action = 'NO_CHANGE';
      }
    }

    return {
      nextPresenceStatus,
      action,
      exitPendingSince,
      exitGraceExpiresAt,
      accumulatedInsideSeconds,
      accumulatedOutsideSeconds,
    };
  }
}
