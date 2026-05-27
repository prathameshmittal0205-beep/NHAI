
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from tensorflow.keras.utils import to_categorical


# ==========================================
# LOAD DATA
# ==========================================

def load_dataset(data_dir='data/processed'):
    X = []
    y = []

    for person_name in os.listdir(data_dir):
        person_path = os.path.join(data_dir, person_name)

        if not os.path.isdir(person_path):
            continue

        for file in os.listdir(person_path):
            file_path = os.path.join(person_path, file)

            try:
                img = tf.keras.utils.load_img(
                    file_path,
                    target_size=(112, 112)
                )

                img = tf.keras.utils.img_to_array(img)
                img = img / 255.0

                X.append(img)
                y.append(person_name)

            except Exception as e:
                print(f"Error loading {file_path}: {e}")

    return np.array(X), np.array(y)


# ==========================================
# MOBILEFACENET BLOCK
# ==========================================

def depthwise_block(x, filters, strides=1):

    # Depthwise Convolution
    x = layers.DepthwiseConv2D(
        kernel_size=3,
        strides=strides,
        padding='same',
        use_bias=False,
        depthwise_initializer='he_normal',
        depthwise_regularizer=regularizers.l2(4e-5)
    )(x)

    x = layers.BatchNormalization()(x)
    x = layers.PReLU(shared_axes=[1, 2])(x)

    # Pointwise Convolution
    x = layers.Conv2D(
        filters,
        kernel_size=1,
        strides=1,
        padding='same',
        use_bias=False,
        kernel_initializer='he_normal',
        kernel_regularizer=regularizers.l2(4e-5)
    )(x)

    x = layers.BatchNormalization()(x)
    x = layers.PReLU(shared_axes=[1, 2])(x)

    return x


# ==========================================
# BUILD MODEL
# ==========================================

def build_mobilefacenet(input_shape=(112, 112, 3), embedding_dim=512, num_classes=2):

    inputs = layers.Input(shape=input_shape)

    x = layers.Conv2D(
        64,
        kernel_size=3,
        strides=2,
        padding='same',
        use_bias=False,
        kernel_initializer='he_normal',
        kernel_regularizer=regularizers.l2(4e-5)
    )(inputs)

    x = layers.BatchNormalization()(x)
    x = layers.PReLU(shared_axes=[1, 2])(x)

    # MobileFaceNet Blocks
    x = depthwise_block(x, 64, strides=1)
    x = depthwise_block(x, 128, strides=2)
    x = depthwise_block(x, 128, strides=1)
    x = depthwise_block(x, 256, strides=2)
    x = depthwise_block(x, 256, strides=1)
    x = depthwise_block(x, 512, strides=2)

    x = layers.GlobalAveragePooling2D()(x)

    embeddings = layers.Dense(
        embedding_dim,
        activation=None,
        kernel_regularizer=regularizers.l2(4e-5)
    )(x)

    outputs = layers.Dense(
        num_classes,
        activation='softmax'
    )(embeddings)

    model = models.Model(inputs, outputs)

    return model


# ==========================================
# TRAIN MODEL
# ==========================================

def train_model():

    print("Loading dataset...")

    X, y = load_dataset()

    if len(X) == 0:
        print("No processed images found.")
        return

    print(f"Dataset size: {len(X)}")

    # Encode labels
    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)

    num_classes = len(np.unique(y_encoded))

    y_categorical = to_categorical(y_encoded, num_classes=num_classes)

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y_categorical,
        test_size=0.2,
        random_state=42,
        stratify=y_categorical
    )

    print(f"Training samples: {len(X_train)}")
    print(f"Testing samples: {len(X_test)}")

    # Build model
    model = build_mobilefacenet(
        input_shape=(112, 112, 3),
        embedding_dim=512,
        num_classes=num_classes
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    model.summary()

    # Callbacks
    checkpoint = ModelCheckpoint(
        'best_model.keras',
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    )

    early_stop = EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    )

    # Train
    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_test, y_test),
        epochs=20,
        batch_size=16,
        callbacks=[checkpoint, early_stop]
    )

    # Save final model
    model.save('mobilefacenet_final.keras')

    print("\nTraining completed successfully.")
    print("Model saved as mobilefacenet_final.keras")


# ==========================================
# MAIN
# ==========================================

if __name__ == '__main__':
    train_model()
