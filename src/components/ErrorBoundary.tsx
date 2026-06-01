import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../types/theme';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRestart = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>SOMETHING WENT WRONG</Text>
          <Text style={styles.message}>
            An unexpected error occurred. Please restart the application.
          </Text>
          <Text style={styles.errorDetails}>{this.state.errorMessage}</Text>
          
          <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>RESTART APP</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.FAILURE_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: FONTS.SIZE_HEADING,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  message: {
    fontSize: FONTS.SIZE_BODY,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorDetails: {
    fontSize: FONTS.SIZE_CAPTION,
    color: COLORS.FAILURE_LIGHT,
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.WHITE,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.FAILURE_BG,
    letterSpacing: 2,
  },
});

export default ErrorBoundary;
