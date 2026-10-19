import { Box, Button, Stack, Text } from '@chakra-ui/react'
import { Component, Fragment, type PropsWithChildren } from 'react'

export class MapBoundary extends Component<
  PropsWithChildren,
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed)
      return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
    return (
      <Box position="absolute" inset="0" bg="surface.subtle" p="5" pt="52">
        <Stack align="center" textAlign="center" gap="3">
          <Text role="status" fontSize="sm">
            The map could not load. Route comparisons and checkpoint details remain available.
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }))
            }
          >
            Retry map
          </Button>
        </Stack>
      </Box>
    )
  }
}
