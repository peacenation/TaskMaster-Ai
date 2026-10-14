import 'package:flutter/material.dart';

import '../api/client.dart';
import '../auth/auth_gateway.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).signIn(_email.text, _password.text);
    } on SignInException catch (e) {
      setState(() => _error = e.message);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).signInWithGoogle();
    } on SignInCancelled {
      // Closed the account picker: nothing to explain.
    } on SignInException catch (e) {
      setState(() => _error = e.message);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final google = SessionScope.of(context).auth.googleAvailable;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Tm.s6),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: AutofillGroup(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: BrandWordmark()),
                      const SizedBox(height: Tm.s1),
                      Center(
                        child: Text(
                          'Clarity. Momentum. Done.',
                          style: TextStyle(color: tm.textMuted),
                        ),
                      ),
                      const SizedBox(height: Tm.s8),
                      Text(
                        'Welcome back',
                        style: Theme.of(context).textTheme.headlineLarge,
                      ),
                      const SizedBox(height: Tm.s6),
                      if (google) ...[
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _google,
                          icon: const _GoogleMark(),
                          label: const Text('Continue with Google'),
                        ),
                        const SizedBox(height: Tm.s4),
                        Row(
                          children: [
                            const Expanded(child: Divider()),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: Tm.s3,
                              ),
                              child: Text(
                                'or sign in with email',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                            const Expanded(child: Divider()),
                          ],
                        ),
                        const SizedBox(height: Tm.s4),
                      ],
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(labelText: 'Email'),
                        validator: (v) => v != null && v.contains('@')
                            ? null
                            : 'Enter your email address',
                      ),
                      const SizedBox(height: Tm.s4),
                      TextFormField(
                        controller: _password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: const InputDecoration(
                          labelText: 'Password',
                        ),
                        validator: (v) => v == null || v.isEmpty
                            ? 'Enter your password'
                            : null,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: Tm.s4),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _error!,
                            style: TextStyle(color: tm.danger),
                          ),
                        ),
                      ],
                      const SizedBox(height: Tm.s6),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: Text(_busy ? 'Signing in…' : 'Sign in'),
                      ),
                      const SizedBox(height: Tm.s4),
                      Text(
                        'New to TaskMasterAi? Create your account on the '
                        'website, then sign in here.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Google's "G", drawn as the brand guidelines require for the sign-in button.
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: const Size.square(18), painter: _GooglePainter());
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final stroke = size.width * 0.2;
    final arcRect = rect.deflate(stroke / 2);
    Paint arc(Color c) => Paint()
      ..color = c
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    const deg = 3.1415926535 / 180;
    canvas.drawArc(
      arcRect,
      -40 * deg,
      -100 * deg,
      false,
      arc(const Color(0xFFEA4335)),
    );
    canvas.drawArc(
      arcRect,
      -140 * deg,
      -90 * deg,
      false,
      arc(const Color(0xFFFBBC05)),
    );
    canvas.drawArc(
      arcRect,
      -230 * deg,
      -95 * deg,
      false,
      arc(const Color(0xFF34A853)),
    );
    canvas.drawArc(
      arcRect,
      -325 * deg,
      -35 * deg,
      false,
      arc(const Color(0xFF4285F4)),
    );
    canvas.drawRect(
      Rect.fromLTWH(
        size.width / 2,
        size.height / 2 - stroke / 2,
        size.width / 2,
        stroke,
      ),
      Paint()..color = const Color(0xFF4285F4),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
