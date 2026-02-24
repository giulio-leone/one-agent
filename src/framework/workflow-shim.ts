/**
 * Workflow package shim.
 *
 * Centralizes direct runtime package bindings in one place.
 * Agent workflow steps should import these symbols from this shim.
 */

export { FatalError, RetryableError, getWritable, getStepMetadata } from 'workflow';
