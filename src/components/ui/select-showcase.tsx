'use client'

import React from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select'

export function SelectShowcase() {
  return (
    <div className="space-y-12 p-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Select Component Showcase</h1>
        <p className="text-muted-foreground">Improved visual appearance with better spacing, animations, and focus states</p>
      </div>

      {/* Basic Example */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold mb-2">Basic Select</h2>
          <p className="text-sm text-muted-foreground mb-3">Clean, minimal design with smooth hover and focus effects</p>
        </div>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
            <SelectItem value="option3">Option 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grouped Example */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold mb-2">Grouped Select</h2>
          <p className="text-sm text-muted-foreground mb-3">Better visual organization with category grouping</p>
        </div>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose a framework..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Frontend</SelectLabel>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="vue">Vue</SelectItem>
              <SelectItem value="svelte">Svelte</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Backend</SelectLabel>
              <SelectItem value="node">Node.js</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="go">Go</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Small Size */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold mb-2">Small Select</h2>
          <p className="text-sm text-muted-foreground mb-3">Compact version for space-constrained layouts</p>
        </div>
        <Select>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Pick one..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small1">Small Option 1</SelectItem>
            <SelectItem value="small2">Small Option 2</SelectItem>
            <SelectItem value="small3">Small Option 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Multiple Selects Row */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold mb-2">Multiple Selects</h2>
          <p className="text-sm text-muted-foreground mb-3">See how multiple selects work together in a form</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Improvements */}
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">✨ Visual Improvements</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Enhanced hover states with subtle background shifts</li>
          <li>• Improved focus rings with better visibility</li>
          <li>• Smooth transitions and animations (150ms duration)</li>
          <li>• Better spacing and padding for comfort</li>
          <li>• Backdrop blur effect on dropdown content</li>
          <li>• Gradient scroll buttons with hover effects</li>
          <li>• Refined typography with better visual hierarchy</li>
          <li>• Shadow refinements for depth perception</li>
        </ul>
      </div>
    </div>
  )
}
