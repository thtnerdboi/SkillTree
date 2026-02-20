import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.log("ErrorBoundary getDerivedStateFromError", error.message);
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log("ErrorBoundary componentDidCatch", error.message, info.componentStack);
  }

  handleReset = () => {
    console.log("ErrorBoundary reset");
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="error-boundary">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.message ?? "Try again."}</Text>
          <Pressable
            onPress={this.handleReset}
            style={styles.button}
            testID="error-boundary-reset"
          >
            <Text style={styles.buttonText}>Reload</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080B14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    color: "#E8EBF7",
    fontSize: 22,
    fontWeight: "700",
  },
  message: {
    color: "#9AA3C7",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#5DE1FF",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonText: {
    color: "#080B14",
    fontWeight: "700",
  },
});
